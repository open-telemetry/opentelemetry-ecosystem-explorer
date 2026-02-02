"""Tests for instrumentation parser system."""

import pytest
from java_instrumentation_watcher.instrumentation_parser import (
    InstrumentationParser,
    ParserFactory,
    ParserV01,
    ParserV02,
    parse_instrumentation_yaml,
)


class TestParserV01:
    def test_get_file_format(self):
        parser = ParserV01()
        assert parser.get_file_format() == 0.1

    def test_parse_basic_yaml(self):
        yaml_content = """
file_format: 0.1
libraries:
  akka:
  - id: akka-actor
    name: Akka Actor
"""
        parser = ParserV01()
        data = parser.parse(yaml_content)

        assert data["file_format"] == 0.1
        assert "libraries" in data
        assert isinstance(data["libraries"], list)
        assert len(data["libraries"]) == 1
        assert data["libraries"][0]["id"] == "akka-actor"
        assert data["libraries"][0]["tags"] == ["akka"]

    def test_parse_cleans_trailing_whitespace(self):
        yaml_content = """
file_format: 0.1
libraries:
  test:
  - name: Test Instrumentation
    description: 'This has trailing whitespace.

        '
"""
        parser = ParserV01()
        data = parser.parse(yaml_content)

        assert data["libraries"][0]["description"] == "This has trailing whitespace."
        assert data["libraries"][0]["tags"] == ["test"]

    def test_parse_cleans_nested_strings(self):
        yaml_content = """
file_format: 0.1
libraries:
  test:
  - name: '  Test with spaces  '
    configurations:
    - name: '  config.name  '
      description: '  Nested description  '
"""
        parser = ParserV01()
        data = parser.parse(yaml_content)

        test_lib = data["libraries"][0]
        assert test_lib["name"] == "Test with spaces"
        assert test_lib["tags"] == ["test"]
        assert test_lib["configurations"][0]["name"] == "config.name"
        assert test_lib["configurations"][0]["description"] == "Nested description"

    def test_parse_preserves_intentional_multiline(self):
        yaml_content = """
file_format: 0.1
libraries:
  test:
  - description: |-
      Line one
      Line two
      Line three
"""
        parser = ParserV01()
        data = parser.parse(yaml_content)

        # Should preserve intentional line breaks but strip outer whitespace
        desc = data["libraries"][0]["description"]
        assert "Line one" in desc
        assert "Line two" in desc
        assert "Line three" in desc
        assert data["libraries"][0]["tags"] == ["test"]

    def test_parse_empty_yaml(self):
        parser = ParserV01()
        data = parser.parse("")
        assert data == {}

    def test_parse_malformed_yaml(self):
        yaml_content = """
file_format: 0.1
libraries:
  test: [unclosed
"""
        parser = ParserV01()
        with pytest.raises(ValueError, match="Error parsing instrumentation YAML"):
            parser.parse(yaml_content)

    def test_clean_strings_with_dict(self):
        parser = ParserV01()
        data = {"key": "  value  ", "nested": {"inner": "  inner value  "}}
        cleaned = parser._clean_strings(data)

        assert cleaned["key"] == "value"
        assert cleaned["nested"]["inner"] == "inner value"

    def test_clean_strings_with_list(self):
        parser = ParserV01()
        data = ["  item1  ", "  item2  "]
        cleaned = parser._clean_strings(data)

        assert cleaned == ["item1", "item2"]

    def test_clean_strings_preserves_non_strings(self):
        parser = ParserV01()
        data = {"int": 42, "float": 3.14, "bool": True, "none": None}
        cleaned = parser._clean_strings(data)

        assert cleaned["int"] == 42
        assert cleaned["float"] == 3.14
        assert cleaned["bool"] is True
        assert cleaned["none"] is None


class TestParserV02:
    def test_get_file_format(self):
        parser = ParserV02()
        assert parser.get_file_format() == 0.2

    def test_parse_basic_yaml(self):
        yaml_content = """
file_format: 0.2
libraries:
  akka:
  - name: akka-actor
    javaagent_target_versions:
    - com.typesafe.akka:akka-actor:[2.3,)
"""
        parser = ParserV02()
        data = parser.parse(yaml_content)

        assert data["file_format"] == 0.2
        assert isinstance(data["libraries"], list)
        assert len(data["libraries"]) == 1
        assert data["libraries"][0]["name"] == "akka-actor"
        assert data["libraries"][0]["tags"] == ["akka"]
        assert "javaagent_target_versions" in data["libraries"][0]

    def test_parse_flattens_libraries(self):
        yaml_content = """
file_format: 0.2
libraries:
  activej:
  - name: activej-http-6.0
    javaagent_target_versions:
    - io.activej:activej-http:[6.0,)
  akka:
  - name: akka-actor
    javaagent_target_versions:
    - com.typesafe.akka:akka-actor:[2.3,)
"""
        parser = ParserV02()
        data = parser.parse(yaml_content)

        assert isinstance(data["libraries"], list)
        assert len(data["libraries"]) == 2
        assert data["libraries"][0]["tags"] == ["activej"]
        assert data["libraries"][1]["tags"] == ["akka"]


class TestParserFactory:
    def test_get_parser_v0_1(self):
        parser = ParserFactory.get_parser(0.1)
        assert isinstance(parser, ParserV01)
        assert parser.get_file_format() == 0.1

    def test_get_parser_v0_2(self):
        parser = ParserFactory.get_parser(0.2)
        assert isinstance(parser, ParserV02)
        assert parser.get_file_format() == 0.2

    def test_get_parser_unsupported_version(self):
        with pytest.raises(ValueError, match="Unsupported file_format: 999.0"):
            ParserFactory.get_parser(999.0)

    def test_get_default_parser(self):
        parser = ParserFactory.get_default_parser()
        assert isinstance(parser, InstrumentationParser)
        # Should return the latest version (0.2 currently)
        assert parser.get_file_format() == 0.2


class TestParseInstrumentationYaml:
    def test_parse_with_explicit_version(self):
        yaml_content = """
file_format: 0.1
libraries: {}
"""
        data = parse_instrumentation_yaml(yaml_content, file_format=0.1)
        assert data["file_format"] == 0.1

    def test_parse_with_auto_detection(self):
        yaml_content = """
file_format: 0.1
libraries:
  test:
  - name: '  Test  '
"""
        data = parse_instrumentation_yaml(yaml_content)
        assert data["file_format"] == 0.1
        assert data["libraries"][0]["name"] == "Test"
        assert data["libraries"][0]["tags"] == ["test"]

    def test_parse_without_file_format_uses_default(self):
        yaml_content = """
libraries:
  test:
  - name: Test
"""
        # Should use default parser when file_format not present
        data = parse_instrumentation_yaml(yaml_content)
        assert "libraries" in data

    def test_parse_with_malformed_yaml_uses_default(self):
        # When auto-detection fails due to malformed YAML,
        # should fall back to default parser (which will then fail appropriately)
        yaml_content = "invalid: [yaml"
        with pytest.raises(ValueError, match="Error parsing instrumentation YAML"):
            parse_instrumentation_yaml(yaml_content)
