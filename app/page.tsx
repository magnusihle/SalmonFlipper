import { App } from "@/components/App";
import { StoreProvider } from "@/lib/store";

export default function Home() {
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  );
}
