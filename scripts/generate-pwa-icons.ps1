Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../public/icons'
New-Item -ItemType Directory -Path $iconDirectory -Force | Out-Null
$targets = @(
  @{ Name = 'icon-192.png'; Size = 192; Badge = $false },
  @{ Name = 'icon-512.png'; Size = 512; Badge = $false },
  @{ Name = 'apple-touch-icon.png'; Size = 180; Badge = $false },
  @{ Name = 'badge-96.png'; Size = 96; Badge = $true }
)
foreach ($target in $targets) {
  $bitmap = New-Object System.Drawing.Bitmap($target.Size, $target.Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 18)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $background = if ($target.Badge) { [System.Drawing.Color]::Transparent } else { [System.Drawing.ColorTranslator]::FromHtml('#123f3a') }
    $graphics.Clear($background)
    $graphics.ScaleTransform($target.Size / 512.0, $target.Size / 512.0)
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $points = [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new(156, 196), [System.Drawing.PointF]::new(256, 140),
      [System.Drawing.PointF]::new(356, 196), [System.Drawing.PointF]::new(356, 316),
      [System.Drawing.PointF]::new(256, 372), [System.Drawing.PointF]::new(156, 316)
    )
    $graphics.DrawPolygon($pen, $points)
    $graphics.DrawLine($pen, 156, 196, 256, 252)
    $graphics.DrawLine($pen, 256, 252, 356, 196)
    $graphics.DrawLine($pen, 256, 252, 256, 372)
    $graphics.DrawLine($pen, 206, 168, 306, 224)
    $bitmap.Save((Join-Path $iconDirectory $target.Name), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $pen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}
