import ProductForm from "../ProductForm";

export default function NewProductPage() {
  return (
    <div>
      <p className="label-technical mb-2">CATALOG / NEW</p>
      <h1 className="mb-10 font-display text-3xl tracking-tight text-bone">New product</h1>
      <ProductForm />
    </div>
  );
}
