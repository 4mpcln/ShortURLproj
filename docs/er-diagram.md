# ER Diagram

```mermaid
erDiagram
  SHORT_URLS {
    uuid id PK
    varchar code UK
    text original_url
    varchar title
    integer click_count
    timestamptz last_clicked_at
    timestamptz created_at
    timestamptz updated_at
  }
```
