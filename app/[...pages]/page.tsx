import { unstable_noStore as noStore } from "next/cache";

import { Home } from "../components/home";

export default async function App() {
  noStore();
  return (
    <>
      <Home />
    </>
  );
}
