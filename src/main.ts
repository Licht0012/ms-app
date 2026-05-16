import "./styles/main.css";
import { AppController } from "./app/AppController";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app element not found");

const app = new AppController();
app.start(root).catch((err) => {
  console.error("App failed to start", err);
  root.textContent = "アプリの起動に失敗しました。ページを再読み込みしてください。";
});
