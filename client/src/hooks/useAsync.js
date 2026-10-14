import { useCallback, useEffect, useRef, useState } from "react";

export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const requestId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async ({ silent = false } = {}) => {
    const id = ++requestId.current;
    setState((prev) => ({ ...prev, loading: !silent || prev.data === null, error: null }));
    try {
      const data = await loaderRef.current();
      if (id === requestId.current) setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (id === requestId.current) setState((prev) => ({ ...prev, loading: false, error }));
      return undefined;
    }
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === "function" ? updater(prev.data) : updater }));
  }, []);

  return { ...state, reload, setData };
}
