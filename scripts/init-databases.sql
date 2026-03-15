-- init-databases.sql
-- 初始化三个环境的数据库

-- 生产环境数据库
CREATE DATABASE lsm_prod;

-- 测试环境数据库
CREATE DATABASE lsm_staging;

-- 开发环境数据库
CREATE DATABASE lsm_dev;

-- 授予权限（根据实际需求调整）
GRANT ALL PRIVILEGES ON DATABASE lsm_prod TO postgres;
GRANT ALL PRIVILEGES ON DATABASE lsm_staging TO postgres;
GRANT ALL PRIVILEGES ON DATABASE lsm_dev TO postgres;

-- 输出创建结果
\echo '=== 数据库初始化完成 ==='
\echo '生产环境: lsm_prod'
\echo '测试环境: lsm_staging'
\echo '开发环境: lsm_dev'