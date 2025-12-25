function debugImpl(message?: unknown, ...optionalParams: unknown[]) {
  if (debugImpl.enabled) {
    console.log(message, ...optionalParams);
  }
}

debugImpl.enabled = false;

export { debugImpl as debug };
