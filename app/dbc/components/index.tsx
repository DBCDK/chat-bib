import { decodeValue } from "./constants";
import ExampleComponent from "./ExampleComponent";
import MaterialCard from "./MaterialCard/MaterialCard";

type ComponentType = {
  [key: string]: (parts: string[], complete: Boolean) => JSX.Element;
};
const components: ComponentType = {
  [ExampleComponent.name]: ExampleComponent.deserialize,
  [MaterialCard.name]: MaterialCard.deserialize,
};

export function deserializeCustomComponent(str: string, complete: Boolean) {
  const parts = str.split(/(?<!%)_/).map((part) => decodeValue(part));
  const deserialize = components[parts[0]];
  if (deserialize) {
    return deserialize(parts.slice(1), complete);
  }

  return null;
}
