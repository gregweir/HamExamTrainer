import { fixture, expect } from '@open-wc/testing';
import { html } from 'lit';
// Registers <tartanleaf-app>
import './app';

describe('TartanleafApp (start screen)', () => {
  it('renders the logo, title and branding', async () => {
    const el = await fixture(html`<tartanleaf-app></tartanleaf-app>`);
    const title = el.shadowRoot!.querySelector('h1');
    expect(title).to.exist;
    expect(title!.textContent).to.equal('Tartanleaf Ham Exam Trainer');

    const logo = el.shadowRoot!.querySelector('img.logo');
    expect(logo).to.exist;
    expect(logo!.getAttribute('alt')).to.equal('Tartanleaf');
    expect(logo!.getAttribute('src') || '').to.not.equal('');
  });
});
