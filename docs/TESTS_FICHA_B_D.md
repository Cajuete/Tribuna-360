# Pruebas Ficha B y Ficha D - Productos

## Información general

- **Rama:** `feature/control-stock`
- **Backend:** `http://localhost:3000`
- **Base de datos:** Supabase
- **Autenticación:** Bearer Token obtenido en `POST /api/v1/auth/login`

### Credenciales de prueba

```json
{
  "email": "admin.demo@example.com",
  "password": "TestStock123"
}
```

### Obtener token

**Request:**
```http
POST /api/v1/auth/login
Content-Type: application/json
```

**Body:**
```json
{
  "email": "admin.demo@example.com",
  "password": "TestStock123"
}
```

**Uso en headers:**
```http
Authorization: Bearer <token>
```

---

# Ficha B - Control de stock

## Caso B1: Crear producto válido con stock 12

**Request:**
```http
POST /api/v1/productos
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Balon Stock Test",
  "price": 100,
  "stock": 12,
  "tenant_id": "11111111-1111-1111-1111-111111111111"
}
```

**Resultado esperado:**
- Status: `201 Created`
- Respuesta con `"stock": 12`

**Resultado obtenido:** PASS

---

## Caso B2: Crear producto con stock negativo

**Body:**
```json
{
  "name": "Balon Negativo",
  "price": 100,
  "stock": -2,
  "tenant_id": "11111111-1111-1111-1111-111111111111"
}
```

**Resultado esperado:**
- Status: `400 Bad Request`

**Resultado obtenido:** PASS

---

## Caso B3: Crear producto con stock decimal

**Body:**
```json
{
  "name": "Balon Decimal",
  "price": 100,
  "stock": 2.5,
  "tenant_id": "11111111-1111-1111-1111-111111111111"
}
```

**Resultado esperado:**
- Status: `400 Bad Request`

**Resultado obtenido:** PASS

---

## Caso B4: Actualizar stock a 0

**Request:**
```http
PUT /api/v1/productos/<PRODUCT_ID>
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "stock": 0
}
```

**Resultado esperado:**
- Status: `200 OK`
- Respuesta con `"stock": 0`

**Resultado obtenido:** PASS

---

## Caso B5: Obtener producto por ID

**Request:**
```http
GET /api/v1/productos/<PRODUCT_ID>
Authorization: Bearer <token>
```

**Resultado esperado:**
- Status: `200 OK`
- Respuesta con campo `stock`

**Resultado obtenido:** PASS

---

## Caso B6: Listar productos

**Request:**
```http
GET /api/v1/productos
Authorization: Bearer <token>
```

**Resultado esperado:**
- Status: `200 OK`
- Todos los productos incluyen `stock`

**Resultado obtenido:** PASS

---

# Ficha D - Búsqueda por nombre

## Caso D1: Listar todos los productos sin parámetro

**Request:**
```http
GET /api/v1/productos
Authorization: Bearer <token>
```

**Resultado esperado:**
- Status: `200 OK`
- Lista completa de productos

**Resultado obtenido:** PASS

---

## Caso D2: Buscar "teclado"

**Request:**
```http
GET /api/v1/productos?buscar=teclado
Authorization: Bearer <token>
```

**Resultado esperado:**
- Status: `200 OK`
- Coincidencias parciales sin distinguir mayúsculas/minúsculas

**Resultado obtenido:** PASS

---

## Caso D3: Buscar sin coincidencias

**Request:**
```http
GET /api/v1/productos?buscar=xyz-no-existe
Authorization: Bearer <token>
```

**Resultado esperado:**
- Status: `200 OK`
- Respuesta: `[]`

**Resultado obtenido:** PASS

---

## Caso D4: Seguridad con comilla simple

**Request:**
```http
GET /api/v1/productos?buscar='
Authorization: Bearer <token>
```

**Resultado esperado:**
- Status: `200 OK`
- No provoca error SQL
- Respuesta: `[]`

**Resultado obtenido:** PASS

---

## Caso D5: Búsqueda case-insensitive

**Request:**
```http
GET /api/v1/productos?buscar=TECLADO
Authorization: Bearer <token>
```

**Resultado esperado:**
- Status: `200 OK`
- Coincidencias encontradas

**Resultado obtenido:** PASS

---

## Resumen

| Ficha | Casos | Estado |
|---|---|---|
| Ficha B - Control de stock | 6 | PASS |
| Ficha D - Búsqueda por nombre | 5 | PASS |

Todas las pruebas fueron verificadas correctamente.
