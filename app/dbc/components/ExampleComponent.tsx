import {
  BEGIN_COMPONENT,
  DELIMITER,
  encodeValue,
  END_COMPONENT,
} from "./constants";

const name = "ExampleComponent";

function ExampleComponent({
  title,
  description,
  complete,
}: {
  title: string;
  description: string;
  complete: Boolean;
}) {
  return (
    <div
      style={{ maxWidth: 300, padding: 18, margin: 24, background: "#933737" }}
    >
      <div style={{ fontSize: "30px" }}>{title}</div>
      <div style={{ fontSize: "12px" }}>{description}</div>
    </div>
  );
}
function serialize({
  say,
  title,
  description,
}: {
  say: Function;
  title: string;
  description: string;
}) {
  say(BEGIN_COMPONENT);
  say(encodeValue(name));
  say(DELIMITER);
  say(encodeValue(title));
  say(DELIMITER);
  say(encodeValue(description));
  say(END_COMPONENT);
}
function deserialize(parts: string[], complete: Boolean) {
  const [title, description] = parts;
  return (
    <ExampleComponent
      title={title}
      description={description}
      complete={complete}
    />
  );
}

export default {
  name,
  serialize,
  deserialize,
};
