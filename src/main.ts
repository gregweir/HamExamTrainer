import './styles/tokens.css';
import { render } from 'lit';
import { html } from 'lit';
import './components/exam-shell.js';

const app = document.querySelector<HTMLElement>('#app');

if (app) {
  render(html`<exam-shell></exam-shell>`, app);
}
