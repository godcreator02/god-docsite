const files = import.meta.glob('./**/*.txt', {
  base: '../content',
  query: '?raw',
  import: 'default',
  eager: true,
});

document.querySelector('#files').textContent = Object.keys(files).sort().join('\n');

