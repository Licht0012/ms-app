import "./styles/main.css";
import { AppController } from "./app/AppController";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app element not found");

const app = new AppController();
void app.start(root);
