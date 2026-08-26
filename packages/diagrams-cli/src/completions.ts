import { CliUsageError } from "./command-model.ts";

const COMMANDS = "render check analyze capabilities format studio lsp ast graph doctor completions";
const OPTIONS =
  "--help --version --color --quiet --verbose --debug --exclude --ignore-file --stdin-filename --files-from --output --out-dir --output-template --theme --theme-file --config --profile --live-theme --snapshot --background --embed-fonts --print-safe --json --pretty --check --write --open --no-open --allow-write --port --stdio --view --diagram-index --compare-layouts";

export function shellCompletions(shell: string | undefined): string {
  switch (shell) {
    case "bash":
      return `# Kekonic Diagrams completion\n_kdiagrams() {\n  local cur="\${COMP_WORDS[COMP_CWORD]}"\n  COMPREPLY=( $(compgen -W "${COMMANDS} ${OPTIONS}" -- "$cur") )\n}\ncomplete -F _kdiagrams kdiagrams\n`;
    case "zsh":
      return `#compdef kdiagrams\n_arguments '1:command:(${COMMANDS})' '*:option:(${OPTIONS})'\n`;
    case "fish":
      return `${COMMANDS.split(" ")
        .map((command) => `complete -c kdiagrams -f -n '__fish_use_subcommand' -a '${command}'`)
        .join("\n")}\n`;
    default:
      throw new CliUsageError("completions requires one shell: bash, zsh, or fish");
  }
}
