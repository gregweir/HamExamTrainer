import './styles/tokens.css';
import { render } from 'lit';
import { html } from 'lit';
import './app';

const app = document.querySelector<HTMLElement>('#app');

if (app) {
  render(html`<tartanleaf-app></tartanleaf-app>`, app);
}
