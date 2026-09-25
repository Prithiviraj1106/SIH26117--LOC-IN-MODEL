"""
code_exec_mcp_server.py — MCP server for sandboxed code execution.

Provides one tool: run_code_sandboxed(code, timeout=15) -> str.

Runs code inside a Docker container with --network none
to guarantee zero external network calls. Uses --memory=256m
and --cpus=0.5 to prevent resource exhaustion.

When to call: When the orchestrator's flow_code_exec() needs
to execute generated Python code safely. This is the code
execution path for the "run code" demo scenario.
When NOT to call: Do not call with untrusted code that
requires network access (it's blocked). If Docker is not
available, execution fails closed.
"""
import subprocess
import json
import ast
from pathlib import Path
from fastmcp import FastMCP

mcp = FastMCP("code_exec", instructions="Execute Python code in a sandboxed Docker container")

DOCKER_IMAGE = "python:3.12"


def _run_in_docker(code: str, timeout: int = 15) -> str:
    """Execute code inside a Docker container with no network access."""
    try:
        result = subprocess.run(
            [
                "docker", "run",
                "--network", "none",
                "--memory", "256m",
                "--cpus", "0.5",
                "--pids-limit", "50",
                "--rm",
                "-i",
                DOCKER_IMAGE,
                "python", "-c", code
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 5,
        )
        output = result.stdout.strip()
        error = result.stderr.strip()
        if result.returncode != 0:
            return f"Error (exit code {result.returncode}): {error or output}"
        return output if output else "Code executed successfully (no output)."
    except subprocess.TimeoutExpired:
        return "Error: Code execution timed out."
    except FileNotFoundError:
        return "Error: Docker is required for sandboxed execution and is not available."
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
def run_code_sandboxed(code: str, timeout: int = 15) -> str:
    """Execute Python code in a sandboxed environment.
    
    Args:
        code: The Python code to execute.
        timeout: Maximum execution time in seconds (default 15).
    
    Returns:
        The code output string, or an error message.
    
When NOT to call: If the code contains 'import socket'
    or 'urllib' or 'requests' — network calls are blocked
    by Docker --network none, but it's better to fail early.
    NEVER call this for general conversation, greetings, or questions
    about how the system itself works."""
    if timeout > 30:
        return "Error: Timeout cannot exceed 30 seconds."
    if not code or len(code) > 20_000:
        return "Error: Code is empty or exceeds the 20,000 character limit."
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return f"Error: Invalid Python syntax: {exc}"
    blocked = {"socket", "subprocess", "ctypes", "requests", "urllib", "pathlib", "shutil"}
    blocked_os_calls = {"system", "popen", "spawnl", "spawnle", "spawnlp", "spawnlpe", "spawnv", "spawnve", "spawnvp", "spawnvpe", "execl", "execle", "execlp", "execv", "execve", "execvp"}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported = {alias.name.split(".")[0] for alias in node.names}
            if imported & blocked:
                return "Error: Network, process, or host-filesystem imports are blocked."
        if isinstance(node, ast.ImportFrom) and (node.module or "").split(".")[0] in blocked:
            return "Error: Network, process, or host-filesystem imports are blocked."
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "os"
            and node.func.attr in blocked_os_calls
        ):
            return "Error: Network, process, or host-filesystem operations are blocked."
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in {"eval", "exec", "__import__"}:
            return "Error: Dynamic code execution is blocked."
    return _run_in_docker(code, timeout)


if __name__ == "__main__":
    import os as _os
    _os.environ["FASTMCP_TRANSPORT"] = "stdio"
    mcp.run(transport="stdio")
