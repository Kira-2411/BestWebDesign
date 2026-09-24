<?php
require_once('database.php');


$queryCategories = 'SELECT * FROM categories ORDER BY categoryID';
$statement1 = $db->prepare($queryCategories);
$statement1->execute();
$categories = $statement1->fetchAll();
$statement1->closeCursor();


if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add_category') {
    $name = filter_input(INPUT_POST, 'name');
    if (!empty($name)) {
        $query = 'INSERT INTO categories (categoryName) VALUES (:name)';
        $statement = $db->prepare($query);
        $statement->bindValue(':name', $name);
        $statement->execute();
        $statement->closeCursor();
        header('Location: list_categories.php');
        exit();
    }
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_category') {
    $category_id = filter_input(INPUT_POST, 'category_id', FILTER_VALIDATE_INT);
    if ($category_id) {
        $query = 'DELETE FROM categories WHERE categoryID = :category_id';
        $statement = $db->prepare($query);
        $statement->bindValue(':category_id', $category_id);
        $statement->execute();
        $statement->closeCursor();
        header('Location: list_categories.php');
        exit();
    }
}
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>My Guitar Shop</title>
    <link rel="stylesheet" type="text/css" href="main.css">
</head>
<body>
    <main>
        <h1>Product Manager</h1>

        <h2>Category List</h2>
        <table>
            <tr>
                <th>Name</th>
                <th>&nbsp;</th>
            </tr>
            <?php foreach ($categories as $category) : ?>
            <tr>
                <td><?php echo htmlspecialchars($category['categoryName']); ?></td>
                <td>
                    <form action="list_categories.php" method="post" style="margin: 0;">
                        <input type="hidden" name="action" value="delete_category">
                        <input type="hidden" name="category_id" value="<?php echo $category['categoryID']; ?>">
                        <input type="submit" value="Delete">
                    </form>
                </td>
            </tr>
            <?php endforeach; ?>
        </table>

        <h2>Add Category</h2>
        <form action="list_categories.php" method="post">
            <input type="hidden" name="action" value="add_category">
            <label>Name:</label>
            <input type="text" name="name" required>
            <input type="submit" value="Add">
        </form>

        <p><a href="index.php">List Products</a></p>
    </main>
</body>
</html>