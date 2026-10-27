/**
 * Ejecuta tareas asíncronas con un máximo de `concurrency` a la vez.
 * `add` espera a que haya un lugar libre, así quien produce las tareas no acumula trabajo en memoria.
 * Las tareas deben manejar sus propios errores (no deben rechazar).
 */
export function createTaskPool(concurrency: number) {
  const running = new Set<Promise<void>>();

  return {
    async add(task: () => Promise<void>): Promise<void> {
      while (running.size >= concurrency) {
        await Promise.race(running);
      }
      const promise: Promise<void> = task().finally(() => running.delete(promise));
      running.add(promise);
    },
    async drain(): Promise<void> {
      await Promise.all(running);
    },
  };
}
