"""
manage_models.py — Terminal tool to add/switch/remove models in models_config.json.

Usage:
    python manage_models.py list
    python manage_models.py add --type chat --name llama3.3:1b --num-ctx 4096
    python manage_models.py switch --type chat --name llama3.2:3b
    python manage_models.py remove --type code

No code changes to orchestrator.py are needed — the router reads from
models_config.json at runtime. This is the "add new models with one line"
story described in the hackathon plan.
"""
import json
import argparse
import sys
from pathlib import Path

CONFIG_PATH = Path(__file__).parent / "models_config.json"


def load_config() -> dict:
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def save_config(config: dict):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)


def list_models():
    config = load_config()
    print("\nCurrent model configuration:")
    print("-" * 60)
    for mtype, info in config["models"].items():
        print(f"  {mtype:12s} -> {info['name']:20s} ({info['purpose']})")
    print(f"\nOllama host: {config['ollama_host']}")
    print(f"Target GPU:  {config['target_hardware']['gpu']}")
    print("-" * 60)


def add_model(mtype: str, name: str, num_ctx: int):
    config = load_config()
    if mtype in config["models"]:
        print(f"  Model type '{mtype}' already exists. Use --switch to replace.")
        sys.exit(1)
    config["models"][mtype] = {"name": name, "purpose": "Custom model", "num_ctx": num_ctx}
    save_config(config)
    print(f"  Added {mtype}: {name}")


def switch_model(mtype: str, name: str):
    config = load_config()
    if mtype not in config["models"]:
        print(f"  Model type '{mtype}' does not exist. Use --add first.")
        sys.exit(1)
    old_name = config["models"][mtype]["name"]
    config["models"][mtype]["name"] = name
    save_config(config)
    print(f"  Switched {mtype}: {old_name} -> {name}")


def remove_model(mtype: str):
    config = load_config()
    if mtype not in config["models"]:
        print(f"  Model type '{mtype}' does not exist.")
        sys.exit(1)
    removed = config["models"].pop(mtype)
    save_config(config)
    print(f"  Removed {mtype} ({removed['name']})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Manage local LLM models for MRPL workbench")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("list", help="Show all configured models")

    p_add = sub.add_parser("add", help="Add a new model")
    p_add.add_argument("--type", required=True)
    p_add.add_argument("--name", required=True)
    p_add.add_argument("--num-ctx", type=int, default=4096)

    p_switch = sub.add_parser("switch", help="Switch an existing model")
    p_switch.add_argument("--type", required=True)
    p_switch.add_argument("--name", required=True)

    p_remove = sub.add_parser("remove", help="Remove a model type")
    p_remove.add_argument("--type", required=True)

    args = parser.parse_args()

    if args.command == "list":
        list_models()
    elif args.command == "add":
        add_model(args.type, args.name, args.num_ctx)
    elif args.command == "switch":
        switch_model(args.type, args.name)
    elif args.command == "remove":
        remove_model(args.type)
    else:
        parser.print_help()
