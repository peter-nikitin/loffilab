<?if (!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED!==true) {
    die();
}?>

<?if (!empty($arResult)) :?>

 <ul class="nav navbar-nav">
                                <li class="nav-item dropdown">
                                    
									<?$APPLICATION->IncludeComponent("bitrix:menu", 
									"main-nav__navbar--dropdown", 
									Array(
										"ALLOW_MULTI_SELECT" => "N",	// Разрешить несколько активных пунктов одновременно
											"CHILD_MENU_TYPE" => "left",	// Тип меню для остальных уровней
											"DELAY" => "N",	// Откладывать выполнение шаблона меню
											"MAX_LEVEL" => "1",	// Уровень вложенности меню
											"MENU_CACHE_GET_VARS" => array(	// Значимые переменные запроса
												0 => "",
											),
											"MENU_CACHE_TIME" => "3600",	// Время кеширования (сек.)
											"MENU_CACHE_TYPE" => "N",	// Тип кеширования
											"MENU_CACHE_USE_GROUPS" => "Y",	// Учитывать права доступа
											"ROOT_MENU_TYPE" => "drop",	// Тип меню для первого уровня
											"USE_EXT" => "N",	// Подключать файлы с именами вида .тип_меню.menu_ext.php
										),
										false
									);?>
                              
                                </li>
<?
foreach ($arResult as $arItem) :
    if ($arParams["MAX_LEVEL"] == 1 && $arItem["DEPTH_LEVEL"] > 1) {
        continue;
    }
?>
    <?if ($arItem["SELECTED"]) :?>
        <li class="nav-item">
			<a href="<?=$arItem["LINK"]?>" class="nav-link active">
				<?=$arItem["TEXT"]?>
			</a>
		</li>
    <?else :?>
        <li class="nav-item">
			<a href="<?=$arItem["LINK"]?>"  class="nav-link">
				<?=$arItem["TEXT"]?>
			</a>
		</li>
    <?endif?>
    
<?endforeach?>

 </ul>
<?endif?>