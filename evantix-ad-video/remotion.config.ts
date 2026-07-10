import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(2);

// Some environments don't allow Remotion to download its own Chrome Headless
// Shell build. If a pre-installed browser is available, point Remotion at it
// via this env var (see README "Troubleshooting" section).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
