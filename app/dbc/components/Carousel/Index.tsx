import {
  BEGIN_COMPONENT,
  DELIMITER,
  encodeValue,
  END_COMPONENT,
} from "../constants";
import { Carousel } from "./Carousel";
const name = "Carousel";

function serialize({ say, workIds }: { say: Function; workIds: string[] }) {
  console.log("in serialize", workIds);
  say(BEGIN_COMPONENT);
  say(encodeValue(name));
  say(DELIMITER);
  say(encodeValue(JSON.stringify(workIds)));
  say(END_COMPONENT);
}
function deserialize(parts: string[], complete: Boolean) {
  const [workIds] = parts;

  return <Carousel workIds={JSON.parse(workIds || "[]")} complete={complete} />;
}

export default {
  name,
  serialize,
  deserialize,
};
