import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { platform } from "@tauri-apps/plugin-os";
import {
  checkAccessibilityPermission,
  requestAccessibilityPermission,
  checkMicrophonePermission,
  requestMicrophonePermission,
} from "tauri-plugin-macos-permissions-api";
import { toast } from "sonner";
import { commands } from "@/bindings";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "../ui/Button";
import { withPermissionTimeout } from "@/lib/utils/permissionTimeout";
import HandyTextLogo from "../icons/HandyTextLogo";
import { Keyboard, Mic, Check, Loader2 } from "lucide-react";

interface AccessibilityOnboardingProps {
  onComplete: () => void;
  preview?: boolean;
}

type PermissionStatus = "checking" | "needed" | "waiting" | "granted" | "error";
type PermissionPlatform = "macos" | "windows" | "other";

interface PermissionsState {
  accessibility: PermissionStatus;
  microphone: PermissionStatus;
}

const AccessibilityOnboarding: React.FC<AccessibilityOnboardingProps> = ({
  onComplete,
  preview = false,
}) => {
  const { t } = useTranslation();
  const [permissionPlatform, setPermissionPlatform] =
    useState<PermissionPlatform | null>(null);
  const [permissions, setPermissions] = useState<PermissionsState>({
    accessibility: "checking",
    microphone: "checking",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(false);
  const checkingRef = useRef(false);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const waitingUntilRef = useRef({ accessibility: 0, microphone: 0 });
  const errorNotifiedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onCompleteRef.current = onComplete;

  const isMacOS = permissionPlatform === "macos";
  const isWindows = permissionPlatform === "windows";
  const showMicrophonePermission = isMacOS || isWindows;
  const showAccessibilityPermission = isMacOS;
  const allGranted = isMacOS
    ? permissions.accessibility === "granted" &&
      permissions.microphone === "granted"
    : isWindows
      ? permissions.microphone === "granted"
      : true;

  const checkPermissions = useCallback(async () => {
    if (
      preview ||
      !mountedRef.current ||
      checkingRef.current ||
      completedRef.current
    )
      return;
    checkingRef.current = true;
    setIsRefreshing(true);
    try {
      const currentPlatform = platform();
      const accessCheck =
        currentPlatform === "macos"
          ? withPermissionTimeout(checkAccessibilityPermission())
          : Promise.resolve(true);
      const microphoneCheck =
        currentPlatform === "macos"
          ? withPermissionTimeout(checkMicrophonePermission())
          : currentPlatform === "windows"
            ? withPermissionTimeout(
                commands.getWindowsMicrophonePermissionStatus(),
              ).then(
                (status) =>
                  !status.supported || status.overall_access !== "denied",
              )
            : Promise.resolve(true);
      const [accessibility, microphone] = await Promise.allSettled([
        accessCheck,
        microphoneCheck,
      ]);
      if (!mountedRef.current) return;
      const granted = (result: PromiseSettledResult<boolean>) =>
        result.status === "fulfilled" && result.value;
      const status = (
        result: PromiseSettledResult<boolean>,
        key: keyof PermissionsState,
      ): PermissionStatus =>
        granted(result)
          ? "granted"
          : result.status === "rejected"
            ? "error"
            : Date.now() < waitingUntilRef.current[key]
              ? "waiting"
              : "needed";
      setPermissions({
        accessibility: status(accessibility, "accessibility"),
        microphone: status(microphone, "microphone"),
      });
      if (
        accessibility.status === "rejected" ||
        microphone.status === "rejected"
      ) {
        if (!errorNotifiedRef.current)
          toast.error(t("onboarding.permissions.errors.checkFailed"));
        errorNotifiedRef.current = true;
      } else {
        errorNotifiedRef.current = false;
      }
      if (granted(accessibility) && granted(microphone)) {
        completedRef.current = true;
        // Native input/device setup belongs to App after onboarding. It must
        // never block permission status or navigation out of this screen.
        timeoutRef.current = setTimeout(() => onCompleteRef.current(), 300);
      }
    } finally {
      checkingRef.current = false;
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, [preview, t]);

  useEffect(() => {
    const current = platform();
    setPermissionPlatform(
      current === "macos"
        ? "macos"
        : current === "windows"
          ? "windows"
          : "other",
    );
    mountedRef.current = true;
    if (preview) {
      setPermissions({
        accessibility: current === "macos" ? "needed" : "granted",
        microphone:
          current === "macos" || current === "windows" ? "needed" : "granted",
      });
      return () => {
        mountedRef.current = false;
      };
    }
    void checkPermissions();
    // One native check at a time; focus also rechecks as soon as Settings closes.
    const interval = setInterval(() => {
      if (!errorNotifiedRef.current) void checkPermissions();
    }, 1000);
    const onFocus = () => void checkPermissions();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkPermissions();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        completedRef.current = false;
      }
    };
  }, [checkPermissions, preview]);

  const openSettings = async (permission: "accessibility" | "microphone") => {
    const pane =
      permission === "accessibility"
        ? "Privacy_Accessibility"
        : "Privacy_Microphone";
    await withPermissionTimeout(
      openUrl(
        `x-apple.systempreferences:com.apple.preference.security?${pane}`,
      ),
    );
  };

  const handleGrantAccessibility = async () => {
    if (preview) return;
    waitingUntilRef.current.accessibility = Date.now() + 20000;
    setPermissions((prev) => ({ ...prev, accessibility: "waiting" }));
    try {
      await withPermissionTimeout(requestAccessibilityPermission());
      await openSettings("accessibility");
    } catch (error) {
      console.error("Failed to request accessibility permission:", error);
      toast.error(t("onboarding.permissions.errors.requestFailed"));
      setPermissions((prev) => ({ ...prev, accessibility: "needed" }));
    }
    void checkPermissions();
  };

  const handleGrantMicrophone = async () => {
    if (preview) return;
    waitingUntilRef.current.microphone = Date.now() + 20000;
    setPermissions((prev) => ({ ...prev, microphone: "waiting" }));
    try {
      if (isWindows) {
        await withPermissionTimeout(commands.openMicrophonePrivacySettings());
      } else {
        await withPermissionTimeout(requestMicrophonePermission());
        await openSettings("microphone");
      }
    } catch (error) {
      console.error("Failed to request microphone permission:", error);
      toast.error(t("onboarding.permissions.errors.requestFailed"));
      setPermissions((prev) => ({ ...prev, microphone: "needed" }));
    }
    void checkPermissions();
  };

  const isChecking =
    permissionPlatform === null ||
    (isMacOS &&
      permissions.accessibility === "checking" &&
      permissions.microphone === "checking") ||
    (isWindows && permissions.microphone === "checking");

  // Still checking platform/initial permissions
  if (isChecking) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-text/50" />
      </div>
    );
  }

  // All permissions granted - show success briefly
  if (allGranted) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-full bg-emerald-500/20">
          <Check className="w-12 h-12 text-emerald-400" />
        </div>
        <p className="text-lg font-medium text-text">
          {t("onboarding.permissions.allGranted")}
        </p>
      </div>
    );
  }

  // Show permissions request screen
  return (
    <div className="h-screen w-full flex flex-col p-6 gap-6 items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <HandyTextLogo width={200} />
      </div>

      <div className="max-w-md w-full flex flex-col items-center gap-4">
        <div className="text-center mb-2">
          <h2 className="text-xl font-semibold text-text mb-2">
            {t("onboarding.permissions.title")}
          </h2>
          <p className="text-text/70">
            {t("onboarding.permissions.description")}
          </p>
        </div>

        {/* Microphone Permission Card */}
        {showMicrophonePermission && (
          <div className="w-full p-4 rounded-lg bg-white/5 border border-mid-gray/20">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-logo-primary/20 shrink-0">
                <Mic className="w-6 h-6 text-logo-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-text">
                  {t("onboarding.permissions.microphone.title")}
                </h3>
                <p className="text-sm text-text/60 mb-3">
                  {t("onboarding.permissions.microphone.description")}
                </p>
                {permissions.microphone === "granted" ? (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <Check className="w-4 h-4" />
                    {t("onboarding.permissions.granted")}
                  </div>
                ) : permissions.microphone === "waiting" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-text/50 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("onboarding.permissions.waiting")}
                    </div>
                    <Button
                      className="min-h-[40px]"
                      variant="secondary"
                      onClick={handleGrantMicrophone}
                    >
                      {t("accessibility.openSettings")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleGrantMicrophone}
                    className="min-h-[40px]"
                    variant="primary-soft"
                  >
                    {isWindows
                      ? t("accessibility.openSettings")
                      : t("onboarding.permissions.grant")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Accessibility Permission Card */}
        {showAccessibilityPermission && (
          <div className="w-full p-4 rounded-lg bg-white/5 border border-mid-gray/20">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-logo-primary/20 shrink-0">
                <Keyboard className="w-6 h-6 text-logo-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-text">
                  {t("onboarding.permissions.accessibility.title")}
                </h3>
                <p className="text-sm text-text/60 mb-3">
                  {t("onboarding.permissions.accessibility.description")}
                </p>
                {permissions.accessibility === "granted" ? (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm">
                    <Check className="w-4 h-4" />
                    {t("onboarding.permissions.granted")}
                  </div>
                ) : permissions.accessibility === "waiting" ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-text/50 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("onboarding.permissions.waiting")}
                    </div>
                    <Button
                      className="min-h-[40px]"
                      variant="secondary"
                      onClick={handleGrantAccessibility}
                    >
                      {t("accessibility.openSettings")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleGrantAccessibility}
                    className="min-h-[40px]"
                    variant="primary-soft"
                  >
                    {t("onboarding.permissions.grant")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        {!preview && (
          <Button
            variant="secondary"
            className="min-h-[40px]"
            onClick={() => void checkPermissions()}
            disabled={isRefreshing}
          >
            {t("onboarding.permissions.checkAgain")}
          </Button>
        )}
        {isMacOS && permissions.accessibility !== "granted" && (
          <p className="text-sm text-text/70 leading-relaxed">
            {t("onboarding.permissions.accessibility.repairHint")}
          </p>
        )}
      </div>
    </div>
  );
};

export default AccessibilityOnboarding;
