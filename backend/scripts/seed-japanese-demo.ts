import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const RESTAURANT_SLUG = "pizzaria-vulcao";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = resolve(SCRIPT_DIR, "../../public/demo-assets");

const products = [
  {
    name: "Combinado Sakura",
    description: "16 peças variadas com salmão fresco, atum e uramaki da casa.",
    price: "64.90",
    category: "Combinados",
    image: "sushi-sakura.jpg",
  },
  {
    name: "Combinado Salmão",
    description: "12 peças de salmão: niguiris, uramakis e sashimis.",
    price: "54.90",
    category: "Combinados",
    image: "sushi-salmon.jpg",
  },
  {
    name: "Hot roll de salmão",
    description: "8 unidades crocantes, recheadas com salmão e cream cheese.",
    price: "32.90",
    category: "Quentes",
    image: "sushi-hot-roll.jpg",
  },
  {
    name: "Ramen tonkotsu",
    description: "Caldo encorpado, noodles, chashu, ovo marinado e cebolinha.",
    price: "42.90",
    category: "Pratos quentes",
    image: "ramen.jpg",
  },
  {
    name: "Temaki de salmão",
    description: "Cone de alga crocante com arroz temperado e salmão fresco.",
    price: "29.90",
    category: "Temakis",
    image: "sushi-salmon.jpg",
  },
];

const promotions = [
  {
    title: "Seleção Sakura",
    description: "Combinados especiais preparados com ingredientes frescos.",
    image: "sushi-sakura.jpg",
  },
  {
    title: "Ramen da casa",
    description: "Uma pausa quentinha com sabores inspirados no Japão.",
    image: "ramen.jpg",
  },
];

async function loadImage(name: string) {
  const data = await readFile(resolve(ASSET_DIR, name));
  if (data.length > 900_000) {
    throw new Error(`Demo image exceeds the restaurant asset size limit: ${name}`);
  }
  return data;
}

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required. The demo seed will not use a default database.");
  }
  const host = new URL(connectionString).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(
      "Refusing to seed a non-local database. This script is only for the local demo.",
    );
  }

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const restaurantResult = await client.query<{ id: number; name: string }>(
      "SELECT id, name FROM restaurants WHERE slug = $1 FOR UPDATE",
      [RESTAURANT_SLUG],
    );
    const restaurant = restaurantResult.rows[0];
    if (!restaurant) {
      throw new Error(`Local demo restaurant not found: ${RESTAURANT_SLUG}`);
    }
    if (!["Pizzaria Vulcão", "Sakura Sushi"].includes(restaurant.name)) {
      throw new Error(`Refusing to overwrite unexpected restaurant data: ${restaurant.name}`);
    }

    const menuResult = await client.query<{ id: number }>(
      `SELECT id FROM menus
       WHERE restaurant_id = $1
       ORDER BY is_active DESC, created_at ASC
       LIMIT 1
       FOR UPDATE`,
      [restaurant.id],
    );
    const menu = menuResult.rows[0];
    if (!menu) throw new Error("The local demo restaurant has no menu to update.");

    const existingProducts = await client.query<{ id: number; name: string }>(
      "SELECT id, name FROM products WHERE restaurant_id = $1 AND menu_id = $2 ORDER BY id FOR UPDATE",
      [restaurant.id, menu.id],
    );
    const allowedExistingNames = new Set([
      "Pizza Marguerita",
      "Refrigerante 1L",
      ...products.map((product) => product.name),
    ]);
    if (
      existingProducts.rows.length > products.length ||
      existingProducts.rows.some((product) => !allowedExistingNames.has(product.name))
    ) {
      throw new Error("Unexpected menu products found; refusing to replace a non-demo catalog.");
    }

    await client.query(
      `UPDATE restaurants
       SET name = $2, description = $3, kind = $4, primary_color = $5,
           logo_url = $6, cover_url = $7, ai_instructions = $8
       WHERE id = $1`,
      [
        restaurant.id,
        "Sakura Sushi",
        "Sushi artesanal, combinados frescos e sabores do Japão preparados na hora.",
        "Restaurante japonês",
        "#A5213A",
        "/demo-assets/sakura-logo.svg",
        "/demo-assets/sakura-cover.jpg",
        "Você é o atendente virtual do Sakura Sushi. Seja cordial, descreva os pratos japoneses com clareza e confirme itens, endereço e forma de pagamento antes de fechar o pedido.",
      ],
    );
    await client.query(`UPDATE menus SET name = $2, ai_instructions = $3 WHERE id = $1`, [
      menu.id,
      "Cardápio japonês",
      "Apresente os combinados, sushis e pratos quentes do Sakura Sushi.",
    ]);

    for (const [index, product] of products.entries()) {
      const imageUrl = `/demo-assets/${product.image}`;
      const existing = existingProducts.rows[index];
      if (existing) {
        await client.query(
          `UPDATE products
           SET name = $2, description = $3, price = $4, category = $5,
               image_url = $6, status = 'DISPONIVEL'
           WHERE id = $1 AND restaurant_id = $7`,
          [
            existing.id,
            product.name,
            product.description,
            product.price,
            product.category,
            imageUrl,
            restaurant.id,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO products (restaurant_id, menu_id, name, description, price, category, image_url, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'DISPONIVEL')`,
          [
            restaurant.id,
            menu.id,
            product.name,
            product.description,
            product.price,
            product.category,
            imageUrl,
          ],
        );
      }
    }

    await client.query(
      `UPDATE restaurant_assets SET is_active = FALSE, updated_at = NOW()
       WHERE restaurant_id = $1 AND kind = 'promotion'`,
      [restaurant.id],
    );
    for (const [index, promotion] of promotions.entries()) {
      const image = await loadImage(promotion.image);
      const existing = await client.query<{ id: number }>(
        `SELECT id FROM restaurant_assets
         WHERE restaurant_id = $1 AND kind = 'promotion' AND title = $2
         ORDER BY id LIMIT 1 FOR UPDATE`,
        [restaurant.id, promotion.title],
      );
      if (existing.rows[0]) {
        await client.query(
          `UPDATE restaurant_assets
           SET description = $2, sort_order = $3, is_active = TRUE,
               mime_type = 'image/jpeg', data = $4, updated_at = NOW()
           WHERE id = $1`,
          [existing.rows[0].id, promotion.description, index, image],
        );
      } else {
        await client.query(
          `INSERT INTO restaurant_assets
           (restaurant_id, kind, title, description, sort_order, is_active, mime_type, data)
           VALUES ($1, 'promotion', $2, $3, $4, TRUE, 'image/jpeg', $5)`,
          [restaurant.id, promotion.title, promotion.description, index, image],
        );
      }
    }

    await client.query("COMMIT");
    console.log(
      "Local demo updated to Sakura Sushi with a Japanese menu and two promotion banners.",
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error: unknown) => {
  console.error("Could not seed the local Japanese restaurant demo:", error);
  process.exitCode = 1;
});
