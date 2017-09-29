<?if (!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED!==true) {
    die();
}?>
<?php
IncludeTemplateLangFile(__FILE__);
$mainPage = $APPLICATION->GetCurPage(false) === '/';
$products = CSite::InDir('/products/');
?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ru" lang="ru">
<head>
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      <link rel="stylesheet" href="<?=SITE_TEMPLATE_PATH?>/css/main.css">
          <link href="https://fonts.googleapis.com/css?family=Noto+Sans:400,700|Noto+Serif:700&amp;subset=cyrillic" rel="stylesheet">
<?$APPLICATION->ShowHead();?>

    <!--[if lte IE 6]>
    <style type="text/css">

        #banner-overlay {
            background-image: none;
            filter: progid:DXImageTransform.Microsoft.AlphaImageLoader(src='<?=SITE_TEMPLATE_PATH?>images/overlay.png', sizingMethod = 'crop');
        }

        div.product-overlay {
            background-image: none;
            filter: progid:DXImageTransform.Microsoft.AlphaImageLoader(src='<?=SITE_TEMPLATE_PATH?>images/product-overlay.png', sizingMethod = 'crop');
        }

    </style>
    <![endif]-->

    <title><?$APPLICATION->ShowTitle()?></title>
</head>
<body>

    <div id="panel"><?$APPLICATION->ShowPanel();?></div>
    <header>
        <div class="container">
            <nav class="navbar">
                <div class="main-nav py-4">

                    <a class="navbar-brand" href="/">
                    <img src="<?=SITE_TEMPLATE_PATH?>/img/logo.svg" height="50" alt="Loffilab" class="navbar-brand__image">
                </a>

                    <div class="hidden-sm btn-group  hidden-md hidden-lg mt-4">
                        <button type="button" class="btn btn-primary collapsed" data-toggle="collapse" data-target="#bs-example-navbar-collapse-1" aria-expanded="false">
                                Меню
                            </button>
                        <button class="btn btn-default " role="button" data-toggle="collapse" href="#mainNavContacts" aria-expanded="false" aria-controls="mainNavContacts">
                                 Контакты
                             </button>
                        <button class="btn btn-default " data-target "#mainNavAdress" role="button" data-toggle="collapse" href="#mainNavAdress" aria-expanded="false" aria-controls="mainNavAdress">
                                 Адрес
                             </button>
                    </div>


                    <div class="navbar-text main-nav__adress" id="mainNavAdress">
                        Москва, ул. Спиридоновка, д.4, стр.1
                    </div>
                    <div class="main-nav__contacts" id="mainNavContacts">
                        <address class="contacts mb-0">
                        <a href="tel:+74994041255" class="main-nav__contacts-item phone">+7 (499) 404-12-55</a>
                        <a href="mailto:info@loffilab.ru" class="main-nav__contacts-item mail">info@loffilab.ru</a>
                    </address>
                    </div>
                    <div class="main-nav__navbar mt-4">
                        <div class="collapse navbar-collapse" id="bs-example-navbar-collapse-1">
                                <?$APPLICATION->IncludeComponent("bitrix:menu", "main-nav__navbar", array(
                                    "ALLOW_MULTI_SELECT" => "N",    // Разрешить несколько активных пунктов одновременно
                                    "CHILD_MENU_TYPE" => "left",    // Тип меню для остальных уровней
                                    "DELAY" => "N",     // Откладывать выполнение шаблона меню
                                    "MAX_LEVEL" => "1",     // Уровень вложенности меню
                                    "MENU_CACHE_GET_VARS" => array(     // Значимые переменные запроса
                                            0 => "",
                                            ),
                                    "MENU_CACHE_TIME" => "3600",    // Время кеширования (сек.)
                                    "MENU_CACHE_TYPE" => "N",   // Тип кеширования
                                    "MENU_CACHE_USE_GROUPS" => "Y",     // Учитывать права доступа
                                    "ROOT_MENU_TYPE" => "top",  // Тип меню для первого уровня
                                    "USE_EXT" => "N",   // Подключать файлы с именами вида .тип_меню.menu_ext.php
                                        ),
                                    false
                                );?>
                        </div>
                    </div>
                </div>
            </nav>
        </div>
    </header>

<?php if ($mainPage || $products) : ?>

<?php else : ?>

        <main>
            <div class="container">
                <h1 id="pagetitle"><?$APPLICATION->ShowTitle(false);?></h1>

                <?endif;?>
