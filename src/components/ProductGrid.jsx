import ProductCard from "./ProductCard";

export default function ProductGrid({ products }) {
  return (
    <div className="grid">
      {products.map((p, index) => (
        <ProductCard key={p.id} product={p} priority={index < 2} />
      ))}
    </div>
  );
}
