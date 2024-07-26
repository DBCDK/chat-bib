import Carousel from "./Carousel/Carousel";
import { decodeValue } from "./constants";
import ExampleComponent from "./ExampleComponent";
import MaterialCard from "./MaterialCard/MaterialCard";
import PluginStatus from "./PluginStatus/PluginStatus";

type ComponentType = {
  [key: string]: (
    parts: string[],
    complete: Boolean,
    parentId?: string,
  ) => JSX.Element | null;
};
const components: ComponentType = {
  [Carousel.name]: Carousel.deserialize,
  [ExampleComponent.name]: ExampleComponent.deserialize,
  [MaterialCard.name]: MaterialCard.deserialize,
  [PluginStatus.name]: PluginStatus.deserialize,
};

export function deserializeCustomComponent(
  str: string,
  complete: Boolean,
  parentId: string,
) {
  const parts = str.split(/(?<!%)_/).map((part) => decodeValue(part));
  const deserialize = components[parts[0]];
  if (deserialize) {
    return deserialize(parts.slice(1), complete, parentId);
  }

  return null;
}
