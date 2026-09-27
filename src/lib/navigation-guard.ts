/** One mounted workspace owns the navigation decision. Old cleanup cannot erase a newer owner. */
export function createNavigationGuard<T>() {
  let current: { run: (event: T) => void } | null = null;
  return {
    register(run: (event: T) => void) {
      const owner = { run };
      current = owner;
      return () => { if (current === owner) current = null; };
    },
    handle(event: T) { current?.run(event); },
  };
}
