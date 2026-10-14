import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import AccessibilityOnboarding from "../../src/components/onboarding/AccessibilityOnboarding";
import i18n from "../../src/i18n";
import "../../src/App.css";

function Harness() {
  const [complete, setComplete] = useState(false);
  return complete ? (
    <div role="status">Permissions complete</div>
  ) : (
    <>
      <AccessibilityOnboarding
        onComplete={() => {
          window.__permissionTest.completed++;
          setComplete(true);
        }}
      />
      <Toaster />
    </>
  );
}

declare global {
  interface Window {
    __permissionTest: {
      accessibility: boolean;
      microphone: boolean;
      hangAccessibility: boolean;
      accessibilityChecks: number;
      initialized: number;
      completed: number;
      openedSettings: string[];
    };
  }
}

await i18n.changeLanguage("en");
document.documentElement.dataset.theme = "dark";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Harness />
  </React.StrictMode>,
);
