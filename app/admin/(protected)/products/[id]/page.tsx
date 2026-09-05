import { notFound } from "next/navigation";
import { getProduct } from "@/app/lib/dataStore";
import ProductForm from "../ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  return (
    <div>
      <p className="label-technical mb-2">CATALOG / EDIT</p>
      <h1 className="mb-10 font-display text-3xl tracking-tight text-bone">{product.name}</h1>
      <ProductForm product={product} />
    </div>
  );
}
