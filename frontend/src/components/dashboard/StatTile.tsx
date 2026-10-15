type StatTileProps = {
  label: string
  value: string
  detail?: string
}

export function StatTile({ label, value, detail }: StatTileProps) {
  return (
    <div className="stat-tile">
      <p className="stat-tile__label">{label}</p>
      <p className="stat-tile__value">{value}</p>
      {detail && <p className="stat-tile__detail">{detail}</p>}
    </div>
  )
}
