import { createRoot } from "react-dom/client";
import "../../web/tokens.css";
import "../tailwind.css";
import "../styles.css";
import "./showcase.css";
import { Showcase } from "./Showcase";

const params = new URLSearchParams(location.search);
const root = document.getElementById("root");
if (!root) throw new Error("showcase root element is missing");
createRoot(root).render(
  <Showcase
    initialLocale={params.get("lang") === "en" ? "en" : "zh-CN"}
    initialTheme={params.get("theme") === "light" ? "light" : "dark"}
  />,
);
