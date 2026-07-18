/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrimitiveListControl } from "./primitive-list-control";
import type {
  ConfigNode,
  ListNode,
  NumberInputNode,
  SelectNode,
  TextInputNode,
  ToggleNode,
  FlagNode,
} from "@/types/configuration";

vi.mock("@/hooks/use-configuration-builder", () => ({
  useConfigurationBuilder: () => ({
    state: {
      values: {},
      enabledSections: {},
      validationErrors: {},
      version: "1.0.0",
      isDirty: false,
    },
    setValue: vi.fn(),
    setEnabled: vi.fn(),
    selectPlugin: vi.fn(),
  }),
}));

function makeListNode(itemSchema: ConfigNode): ListNode {
  return {
    controlType: "list",
    key: "tags",
    label: "Tags",
    path: "tags",
    itemSchema,
  };
}

const textItem: TextInputNode = {
  controlType: "text_input",
  key: "item",
  label: "Item",
  path: "tags.item",
};
const numberItem: NumberInputNode = {
  controlType: "number_input",
  key: "item",
  label: "Item",
  path: "tags.item",
};
const toggleItem: ToggleNode = {
  controlType: "toggle",
  key: "item",
  label: "Item",
  path: "tags.item",
};
const flagItem: FlagNode = {
  controlType: "flag",
  key: "item",
  label: "Item",
  path: "tags.item",
};
const selectItem: SelectNode = {
  controlType: "select",
  key: "item",
  label: "Item",
  path: "tags.item",
  enumOptions: [
    { value: "a", description: "" },
    { value: "b", description: "" },
  ],
};

describe("PrimitiveListControl — text_input items", () => {
  it("renders a chevron header with the list label and an Add button", () => {
    const onChange = vi.fn();
    render(
      <PrimitiveListControl
        node={makeListNode(textItem)}
        itemSchema={textItem}
        path="tags"
        value={["a", "b"]}
        onChange={onChange}
      />
    );
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add item to Tags/ })).toBeInTheDocument();
  });

  it("renders one text input per item with the correct value", () => {
    render(
      <PrimitiveListControl
        node={makeListNode(textItem)}
        itemSchema={textItem}
        path="tags"
        value={["alpha", "beta"]}
        onChange={vi.fn()}
      />
    );
    const inputs = screen.getAllByRole("textbox");
    expect(inputs).toHaveLength(2);
    expect((inputs[0] as HTMLInputElement).value).toBe("alpha");
    expect((inputs[1] as HTMLInputElement).value).toBe("beta");
  });

  it("Add appends an empty string to the items array", () => {
    const onChange = vi.fn();
    render(
      <PrimitiveListControl
        node={makeListNode(textItem)}
        itemSchema={textItem}
        path="tags"
        value={["alpha"]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Add item to Tags/ }));
    expect(onChange).toHaveBeenCalledWith("tags", ["alpha", ""]);
  });

  it("Remove drops the item at that index", () => {
    const onChange = vi.fn();
    render(
      <PrimitiveListControl
        node={makeListNode(textItem)}
        itemSchema={textItem}
        path="tags"
        value={["alpha", "beta", "gamma"]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Remove item 2/ }));
    expect(onChange).toHaveBeenCalledWith("tags", ["alpha", "gamma"]);
  });
});

describe("PrimitiveListControl — number_input items", () => {
  it("renders one number input per item and Add seeds with 0", () => {
    const onChange = vi.fn();
    render(
      <PrimitiveListControl
        node={makeListNode(numberItem)}
        itemSchema={numberItem}
        path="tags"
        value={[1, 2]}
        onChange={onChange}
      />
    );
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Add item to Tags/ }));
    expect(onChange).toHaveBeenCalledWith("tags", [1, 2, 0]);
  });
});

describe("PrimitiveListControl — toggle items", () => {
  it("renders one switch per item and Add seeds with false", () => {
    const onChange = vi.fn();
    render(
      <PrimitiveListControl
        node={makeListNode(toggleItem)}
        itemSchema={toggleItem}
        path="tags"
        value={[true, false]}
        onChange={onChange}
      />
    );
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    expect(switches[0].getAttribute("aria-checked")).toBe("true");
    expect(switches[1].getAttribute("aria-checked")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Add item to Tags/ }));
    expect(onChange).toHaveBeenCalledWith("tags", [true, false, false]);
  });

  it("clicking a switch flips that item's value", () => {
    const onChange = vi.fn();
    render(
      <PrimitiveListControl
        node={makeListNode(toggleItem)}
        itemSchema={toggleItem}
        path="tags"
        value={[true, false]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(onChange).toHaveBeenCalledWith("tags", [false, false]);
  });
});

describe("PrimitiveListControl — flag items", () => {
  it("treats truthy values as checked and seeds Add with false", () => {
    const onChange = vi.fn();
    render(
      <PrimitiveListControl
        node={makeListNode(flagItem)}
        itemSchema={flagItem}
        path="tags"
        value={[{}, false]}
        onChange={onChange}
      />
    );
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    expect(switches[0].getAttribute("aria-checked")).toBe("true");
    expect(switches[1].getAttribute("aria-checked")).toBe("false");
  });
});

describe("PrimitiveListControl — select items", () => {
  it("renders one combobox per item with the schema's enum options", () => {
    const onChange = vi.fn();
    render(
      <PrimitiveListControl
        node={makeListNode(selectItem)}
        itemSchema={selectItem}
        path="tags"
        value={["a"]}
        onChange={onChange}
      />
    );
    const combos = screen.getAllByRole("combobox");
    expect(combos).toHaveLength(1);
    expect((combos[0] as HTMLSelectElement).value).toBe("a");
    fireEvent.click(screen.getByRole("button", { name: /Add item to Tags/ }));
    expect(onChange).toHaveBeenCalledWith("tags", ["a", ""]);
  });
});

describe("PrimitiveListControl — empty/null states", () => {
  it("renders empty placeholder when items is []", () => {
    render(
      <PrimitiveListControl
        node={makeListNode(textItem)}
        itemSchema={textItem}
        path="tags"
        value={[]}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("renders empty placeholder when value is null", () => {
    render(
      <PrimitiveListControl
        node={makeListNode(textItem)}
        itemSchema={textItem}
        path="tags"
        value={null}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

describe("PrimitiveListControl — minItems constraint", () => {
  it("hides the Remove button when items.length === minItems", () => {
    const node: ListNode = {
      ...makeListNode(textItem),
      constraints: { minItems: 1 },
    };
    render(
      <PrimitiveListControl
        node={node}
        itemSchema={textItem}
        path="tags"
        value={["only"]}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Remove item/ })).not.toBeInTheDocument();
  });
});
