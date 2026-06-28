/** Fletë Dalje — remove stock from a warehouse (blocks if insufficient). */
import { WarehouseDocForm } from "@/components/warehouse-doc-form";

export default function OutboundDocScreen() {
  return <WarehouseDocForm kind="outbound" />;
}
