#!/usr/bin/env python3
"""Keep this personal app's code identity stable across local rebuilds.

The private certificate lives outside the repository in a dedicated keychain.
Its certificate is trusted only for code signing in the user's trust settings.
The system trust store and the login keychain are not modified.
"""

import argparse
import os
from pathlib import Path
import plistlib
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
IDENTIFIER = "com.jaeuchoe.handy.personal"


def run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        # Never include arguments: security commands contain local keychain secrets.
        raise RuntimeError(f"{Path(args[0]).name}: {result.stderr.strip()}")
    return result.stdout.strip()


def signing_identity():
    directory = Path.home() / "Library/Application Support" / IDENTIFIER / "local-signing"
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    keychain = directory / "handy-personal.keychain-db"
    password_file = directory / "keychain-password"
    certificate = directory / "certificate.pem"
    if not keychain.exists():
        if password_file.exists() or certificate.exists():
            raise RuntimeError("Incomplete signing identity; restore its keychain before rebuilding")
        password = secrets.token_hex(32)
        with tempfile.TemporaryDirectory(prefix="handy-personal-signing-") as temporary:
            temporary = Path(temporary)
            config = temporary / "certificate.conf"
            config.write_text("""[req]
prompt=no
distinguished_name=subject
x509_extensions=extensions
[subject]
CN=Handy Personal Local Signing
O=Handy Personal
[extensions]
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=critical,codeSigning
subjectKeyIdentifier=hash
""")
            key = temporary / "private.pem"
            cert = temporary / "certificate.pem"
            archive = temporary / "identity.p12"
            run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256",
                "-days", "3650", "-config", str(config), "-keyout", str(key), "-out", str(cert))
            export_args = ["openssl", "pkcs12", "-export", "-inkey", str(key), "-in", str(cert),
                           "-out", str(archive), "-passout", "pass:" + password]
            if run("openssl", "version").startswith("OpenSSL 3"):
                export_args.append("-legacy")
            run(*export_args)
            run("security", "create-keychain", "-p", password, str(keychain))
            try:
                run("security", "unlock-keychain", "-p", password, str(keychain))
                run("security", "import", str(archive), "-k", str(keychain), "-P", password,
                    "-T", "/usr/bin/codesign")
                run("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:",
                    "-s", "-k", password, str(keychain))
                shutil.copyfile(cert, certificate)
                password_file.write_text(password)
                password_file.chmod(0o600)
            except BaseException:
                # Only this just-created, not-yet-used identity is removed on setup failure.
                run("security", "delete-keychain", str(keychain))
                certificate.unlink(missing_ok=True)
                password_file.unlink(missing_ok=True)
                raise
    if not password_file.exists() or not certificate.exists():
        raise RuntimeError("Signing identity is incomplete; do not generate a replacement certificate")
    password = password_file.read_text()
    fingerprint = run("openssl", "x509", "-in", str(certificate), "-noout", "-fingerprint", "-sha1")
    fingerprint = fingerprint.split("=", 1)[1].replace(":", "")
    return keychain, password, fingerprint


def main():
    if sys.platform != "darwin":
        raise RuntimeError("This signing command is for the personal macOS build")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app", type=Path, default=ROOT / "src-tauri/target/release/bundle/macos/Handy Personal.app")
    args = parser.parse_args()
    app = args.app.resolve()
    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    if info.get("CFBundleIdentifier") != IDENTIFIER:
        raise RuntimeError("Refusing to sign an app other than Handy Personal")
    os.umask(0o077)
    keychain, password, fingerprint = signing_identity()
    search_list = shlex.split(run("security", "list-keychains", "-d", "user"))
    requirement = f'designated => identifier "{IDENTIFIER}" and certificate leaf = H"{fingerprint}"'
    common = ["codesign", "--force", "--sign", fingerprint, "--keychain", str(keychain),
              "--options", "runtime", "--timestamp=none"]
    try:
        run("security", "unlock-keychain", "-p", password, str(keychain))
        if str(keychain) not in search_list:
            run("security", "list-keychains", "-d", "user", "-s", *search_list, str(keychain))
        valid = run("security", "find-identity", "-v", "-p", "codesigning", str(keychain))
        if fingerprint not in valid:
            # Leaf-only trust, scoped to code signing in the current user domain.
            run("security", "add-trusted-cert", "-r", "trustRoot", "-p", "codeSign",
                "-k", str(keychain), str(keychain.parent / "certificate.pem"))
        # Seal nested code first; the app is signed last so its resource seal is current.
        executable = app / "Contents/MacOS" / info["CFBundleExecutable"]
        mach_o = {b"\xcf\xfa\xed\xfe", b"\xce\xfa\xed\xfe", b"\xca\xfe\xba\xbe", b"\xbe\xba\xfe\xca"}
        for path in sorted((app / "Contents").rglob("*")):
            if path.is_file() and not path.is_symlink() and path != executable:
                with path.open("rb") as handle:
                    if handle.read(4) in mach_o:
                        run(*common, str(path))
        run(*common, "--requirements", "=" + requirement, "--entitlements", str(ROOT / "src-tauri/Entitlements.plist"), str(app))
        run("codesign", "--verify", "--deep", "--strict", str(app))
        signed_requirement = run("codesign", "--display", "-r-", str(app))
        # codesign emits the requirement to stdout and diagnostic paths to stderr.
        print("Signed Handy Personal with its persistent local certificate")
        print("Certificate fingerprint: " + fingerprint)
        print(signed_requirement)
    finally:
        try:
            run("security", "list-keychains", "-d", "user", "-s", *search_list)
        finally:
            run("security", "lock-keychain", str(keychain))


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
