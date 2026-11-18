import GoogleTagManager from "./google-tag-manager";
import OpenPanelAnalytics from "./open-panel";
import Plausible from "./plausible";

export default function Analytics() {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <>
      <OpenPanelAnalytics />
      <GoogleTagManager />
      <Plausible />
    </>
  );
}
