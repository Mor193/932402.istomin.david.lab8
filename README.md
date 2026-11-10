erDiagram
    BORROWERS ||--o{ BOOKS : "borrows"
    
    BORROWERS {
        INTEGER id PK
        TEXT full_name
        TEXT contact
    }

    BOOKS {
        INTEGER id PK
        TEXT title
        TEXT author
        TEXT isbn UK
        TEXT status "CHECK: available, issued, reserved"
        TEXT due_date "ISO 8601: YYYY-MM-DD"
        INTEGER borrower_id FK
        DATETIME created_at
    }