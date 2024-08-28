import { ToolDef } from "..";
import { GenerateRequest } from "../..";
import PluginStatus from "../../components/PluginStatus/PluginStatus";
import readyTool from "../ready";

export function createPlanner(tools: ToolDef[]) {
  const schema = {
    type: "function",
    function: {
      name: "tool_planner",
      description:
        "Determine what tools should be called to answer the users latest message (and only that)",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  };

  tools.forEach((tool) => {
    const properties: any = schema.function.parameters.properties;
    properties[tool.schema.function.name] = {
      type: "boolean",
      description: tool.schema.function.description,
    };
    const required: string[] = schema.function.parameters.required;
    required.push(tool.schema.function.name);
  });

  const res = {
    dependencies: [],
    schema,
    func: async (args: any, input: GenerateRequest) => {
      let shouldCallMap = { ...args };

      // Check dependencies of the tools that need calling
      tools
        .filter((tool) => shouldCallMap[tool.schema.function.name])
        .forEach((tool) => {
          if (
            tool.dependencies.length > 0 &&
            tool.dependencies.filter(
              (tool) => !!shouldCallMap[tool.schema.function.name],
            ).length === 0
          ) {
            // Add a dependency
            shouldCallMap[tool.dependencies[0].schema.function.name] = true;
          }
        });

      const selectedTools: any = tools.filter(
        (tool) => shouldCallMap[tool.schema.function.name],
      );

      PluginStatus.serialize({
        say: input.say,
        pluginName: "user_intention",
        description: `Intention: ${selectedTools.map((t: any) => t.schema.function.name).join("->")}`,
      });

      selectedTools.push(readyTool);

      PluginStatus.serialize({
        say: input.say,
        pluginName: "planner",
        description:
          "Plan: " +
          selectedTools
            .map((tool: any) => tool.schema.function.name)
            .join("->"),
      });
      return {
        tools: selectedTools,
        plan:
          "Plan for tool calling: " +
          selectedTools
            .map(
              (tool: any, index: number) => `${index + 1}.  
    Call tool: ${tool.schema.function.name}
    Goal: ${tool.schema.function.description}`,
            )
            .join("\n\n"),
      };
    },
  } as ToolDef;

  return res;
}
