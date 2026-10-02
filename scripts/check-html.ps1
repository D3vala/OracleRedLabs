$ErrorActionPreference = "Stop"

$frontend = Join-Path (Split-Path $PSScriptRoot -Parent) "frontend"
$issues = [System.Collections.Generic.List[string]]::new()

Get-ChildItem -LiteralPath $frontend -Filter "*.html" | ForEach-Object {
  $page = $_
  $content = Get-Content -LiteralPath $page.FullName -Raw
  $ids = [regex]::Matches($content, '\bid="([^"]+)"') |
    ForEach-Object { $_.Groups[1].Value }

  $ids | Group-Object | Where-Object Count -gt 1 | ForEach-Object {
    $issues.Add("$($page.Name): duplicate id $($_.Name)")
  }

  foreach ($attribute in @("for", "aria-controls", "aria-labelledby", "data-error-for")) {
    $pattern = '\b' + [regex]::Escape($attribute) + '="([^"]+)"'
    [regex]::Matches($content, $pattern) | ForEach-Object {
      foreach ($target in ($_.Groups[1].Value -split '\s+')) {
        if ($target -and $target -notin $ids) {
          $issues.Add("$($page.Name): $attribute references missing id $target")
        }
      }
    }
  }

  [regex]::Matches($content, '(?:href|src)="([^"]+)"') | ForEach-Object {
    $reference = $_.Groups[1].Value
    if ($reference -match '^(?:https?:|mailto:|tel:|#|data:|javascript:|/api/)') {
      return
    }
    $local = ($reference -split '[?#]')[0]
    if ($local -and -not (Test-Path -LiteralPath (Join-Path $page.DirectoryName $local))) {
      $issues.Add("$($page.Name): missing local reference $reference")
    }
  }
}

if ($issues.Count) {
  $issues | Sort-Object -Unique | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Output "HTML checks passed: local references, IDs, labels, and ARIA targets are consistent."
