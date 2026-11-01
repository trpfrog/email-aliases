import { createTheme } from "@mantine/core";
import { app } from "../../app.config";

export const theme = createTheme({
  primaryColor: "brand",
  primaryShade: app.theme.primaryShade,
  colors: { brand: app.theme.primaryColor },
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
  defaultRadius: "md",
  fontSizes: { sm: "0.8125rem" },
  headings: { fontWeight: "600" },
});
