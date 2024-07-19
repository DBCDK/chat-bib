import { useId, useMemo } from "react";
import {
  BEGIN_COMPONENT,
  DELIMITER,
  encodeValue,
  END_COMPONENT,
} from "../constants";
import { getGlobalState, setGlobalState } from "../hooks/useGlobalState";

const name = "PluginStatusComponent";

function PluginStatusComponent({
  pluginName,
  description,
  args,
  complete,
  parentId,
}: {
  pluginName: string;
  description: string;
  args: string;
  complete: Boolean;
  parentId?: string;
}) {
  const componentId = useId();

  useMemo(() => {
    if (componentId && parentId) {
      const obj = getGlobalState(parentId) || { actions: [] };
      if (!obj?.actions?.find((a: any) => a.componentId === componentId)) {
        obj?.actions?.push({ componentId, pluginName, description, args });
        setGlobalState(parentId, { ...obj });
      }
    }
  }, [parentId, componentId]);

  return null;
}
function serialize({
  say,
  pluginName,
  description,
  args,
}: {
  say: Function;
  pluginName: string;
  description: string;
  args?: string[];
}) {
  say(BEGIN_COMPONENT);
  say(encodeValue(name));
  say(DELIMITER);
  say(encodeValue(pluginName));
  say(DELIMITER);
  say(encodeValue(description));
  say(DELIMITER);
  say(encodeValue(JSON.stringify(args || [])));
  say(END_COMPONENT);
}

function deserialize(parts: string[], complete: Boolean, parentId?: string) {
  if (!complete) {
    return null;
  }

  const [pluginName, description, args] = parts;

  return (
    <PluginStatusComponent
      pluginName={pluginName}
      description={description}
      args={args}
      complete={complete}
      parentId={parentId}
    />
  );
}

export default {
  name,
  serialize,
  deserialize,
};
