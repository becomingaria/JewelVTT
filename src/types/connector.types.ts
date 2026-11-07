export type ConnectorSide = "top" | "right" | "bottom" | "left"

export interface ConnectorEnd {
    humbugId: string
    side: ConnectorSide
}

/** A flowchart arrow from one humbug's edge to another's */
export interface Connector {
    id: string
    from: ConnectorEnd
    to: ConnectorEnd
}
