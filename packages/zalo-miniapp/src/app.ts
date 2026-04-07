// ZMP UI stylesheet
import "zmp-ui/zaui.css";
// App stylesheet
import "./styles/app.css";

// React core
import React from "react";
import { createRoot } from "react-dom/client";

// App component
import Layout from "./components/Layout";

// Expose app configuration
import appConfig from "../app-config.json";

if (!(window as any).APP_CONFIG) {
  (window as any).APP_CONFIG = appConfig;
}

const root = createRoot(document.getElementById("app")!);
root.render(React.createElement(Layout));
