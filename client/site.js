// Public presentation settings only. Never include secrets or OAuth tokens.
export const SITE = Object.freeze({
  name: 'BYPASSER', logo: '/public/img/logo.svg', banner: '', background: '', og: '/public/img/og.png',
  credits: [
    { name: 'The guide author', role: 'Research & manual documentation', image: '', key: 'SITE.credits[0].image' },
    { name: 'Open-source builders', role: 'Node.js, Python & the web', image: '', key: 'SITE.credits[1].image' },
    { name: 'The community', role: 'Feedback, testing & support', image: '', key: 'SITE.credits[2].image' }
  ]
});
