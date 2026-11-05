import './styles/tokens.css';
import { render } from 'lit';
import { html } from 'lit';
import { applyInitialThemeMode } from './lib/theme.js';
import './components/exam-shell.js';

// theme first: the suite's preference is inherited where the origins share
// localStorage (radiobook.ca/trainer/), otherwise the OS preference applies.
applyInitialThemeMode();

const app = document.querySelector<HTMLElement>('#app');

if (app) {
  render(html`<exam-shell></exam-shell>`, app);
}
