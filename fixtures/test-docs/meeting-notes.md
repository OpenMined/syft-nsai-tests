# Team Meeting Notes - March 2026

## Attendees
- Alice Chen (Engineering Lead)
- Bob Martinez (Product Manager)
- Carol Wu (Data Scientist)
- David Kim (DevOps)

## Agenda

### 1. Sprint Review
- Completed dataset ingestion pipeline optimization (2x throughput improvement)
- Shipped new file explorer UI with multi-select and directory browsing
- Fixed race condition in concurrent ChromaDB writes

### 2. Upcoming Work
- Implement batch ingestion for large document sets (>1000 files)
- Add support for PDF table extraction
- Migrate from SQLite to PostgreSQL for production deployments

### 3. Technical Decisions
- Agreed to use FastAPI background tasks for async ingestion instead of Celery
- Will adopt Pydantic v2 for all new schema definitions
- Standardize on ChromaDB 0.5.x for vector storage

## Action Items
- [ ] Alice: Draft RFC for batch ingestion architecture
- [ ] Bob: Update roadmap with Q2 milestones
- [ ] Carol: Benchmark embedding models for accuracy vs speed tradeoff
- [ ] David: Set up staging environment with PostgreSQL
