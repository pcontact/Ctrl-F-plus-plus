

(  async () => {
  const searchModule = (await import('./searchModule.js'))
  searchModule.init();
})()