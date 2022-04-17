--Create a category
CREATE TABLE IF NOT EXISTS category
(
    ID SERIAL,
    name VARCHAR(255),
    description TEXT,
    CONSTRAINT A_CATEGORY_FK PRIMARY KEY (ID)
);
--Create a tag
CREATE TABLE IF NOT EXISTS tag(
    ID SERIAL,
    name VARCHAR(255),
    description TEXT,
    CONSTRAINT A_TAG_FK PRIMARY KEY (ID)
);
--Create a food_tag
CREATE TABLE IF NOT EXISTS food_tag(
    ID SERIAL,
    food_id INT,
    tag_id INT,
    CONSTRAINT A_FOODTAG_PK PRIMARY KEY (ID)
);
--Create a address
CREATE TABLE IF NOT EXISTS addresses(
    ID SERIAL,
    user_id INT,
    name TEXT,
    phone TEXT,
    provinceid TEXT,
    districtid TEXT,
    wardid TEXT,
    street TEXT,
    address_default BOOLEAN,
    CONSTRAINT A_ADDRESSES_PK PRIMARY KEY (ID)
);
--Create a users
CREATE TABLE IF NOT EXISTS users(
    ID SERIAL,
    name VARCHAR(255),
    password VARCHAR(255),
    phone VARCHAR(255),
    email VARCHAR(255),
    roles INT,
    CONSTRAINT A_USER_PK PRIMARY KEY (ID)
);
--Create a usnot_userer
CREATE TABLE IF NOT EXISTS not_user(
    ID SERIAL,
    name VARCHAR(255),
    phone VARCHAR(255),
    provinceid INT,
    districtid INT,
    wardid INT,
    order_id INT,
    CONSTRAINT A_NOTUSER_PK PRIMARY KEY (ID)
);
--Create a foods
CREATE TABLE IF NOT EXISTS foods(
    ID SERIAL,
    category_id INT,
    name VARCHAR(255),
    description TEXT,
    price BIGINT,
    images TEXT,
    CONSTRAINT A_FOODS_PK PRIMARY KEY (ID)
);

--Create a cart
CREATE TABLE IF NOT EXISTS cart(
    ID SERIAL,
    product_id INT,
    quantity INT,
    user_id INT,
    CONSTRAINT A_CART_PK PRIMARY KEY (ID)
);

--Create a wishlist
CREATE TABLE IF NOT EXISTS wishlist(
    ID SERIAL,
    product_id INT,
    user_id INT,
    CONSTRAINT A_WISHLIST_PK PRIMARY KEY (ID)
);
--Create a order_items
CREATE TABLE IF NOT EXISTS order_items(
    ID SERIAL,
    order_id INT,
    food_id INT,
    quantity INT,
    price BIGINT,
    note VARCHAR(255),
    CONSTRAINT A_ORDERITEMS_PK PRIMARY KEY (ID)
);
--Create a order
-- states: draft, sale order, delivering, done
CREATE TABLE IF NOT EXISTS orders(
    ID SERIAL,
    owner_id INT,
    address_id INT,
    delivery_time TIMESTAMP,
    delivery_type_id INT,
    delivery_fee BIGINT,
    discount bigint,
    amount BIGINT,
    states TEXT
    CONSTRAINT A_ORDER_PK PRIMARY KEY (ID)
);
--Create a delivery type
CREATE TABLE IF NOT EXISTS type_of_delivery(
    ID SERIAL,
    name TEXT,
    description TEXT,
    fee BIGINT,
    CONSTRAINT A_type_of_delivery_PK PRIMARY KEY (ID)
);

--set foreign key
ALTER TABLE foods ADD CONSTRAINT FK_FOODS_CATEGORY FOREIGN KEY (category_id) REFERENCES category (ID);
ALTER TABLE food_tag ADD CONSTRAINT FK_FOODTAG_TAG FOREIGN KEY (tag_id) REFERENCES tag (ID);
ALTER TABLE food_tag ADD CONSTRAINT FK_FOODTAG_FOODS FOREIGN KEY (food_id) REFERENCES foods (ID);
ALTER TABLE order_items ADD CONSTRAINT FK_ORDERITEMS_FOODS FOREIGN KEY (food_id) REFERENCES foods (ID);
ALTER TABLE orders ADD CONSTRAINT FK_ORDER_TYPEDELIVERY FOREIGN KEY (delivery_type_id) REFERENCES type_of_delivery (ID);
ALTER TABLE orders ADD CONSTRAINT FK_ORDER_USER FOREIGN KEY (owner_id) REFERENCES users (ID);
ALTER TABLE addresses ADD CONSTRAINT FK_ADDRESSES_USER FOREIGN KEY (user_id) REFERENCES users (ID);
ALTER TABLE addresses ADD CONSTRAINT FK_ADDRESSES_PROVINCE FOREIGN KEY (provinceid) REFERENCES province (provinceid);
ALTER TABLE addresses ADD CONSTRAINT FK_ADDRESSES_DICTRICT FOREIGN KEY (districtid) REFERENCES district (districtid);

ALTER TABLE not_user ADD CONSTRAINT FK_NOTUSER_PROVINCE FOREIGN KEY (provinceid) REFERENCES province (provinceid);
ALTER TABLE not_user ADD CONSTRAINT FK_NOTUSER_DICTRICT FOREIGN KEY (districtid) REFERENCES district (districtid);
ALTER TABLE not_user ADD CONSTRAINT FK_NOTUSER_ORDER FOREIGN KEY (order_id) REFERENCES orders(ID);






