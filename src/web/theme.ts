import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "forest",
  primaryShade: 7,
  colors: {
    forest: [
      "#f0f7f1",
      "#e0ede2",
      "#c1d9c6",
      "#9bc3a5",
      "#73aa83",
      "#539367",
      "#3b7c52",
      "#276349",
      "#20513c",
      "#193e2f",
    ],
  },
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif',
  defaultRadius: "md",
  fontSizes: { sm: "0.8125rem" },
  headings: { fontWeight: "600" },
});
