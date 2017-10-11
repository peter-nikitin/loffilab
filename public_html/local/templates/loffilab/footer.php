<?if (!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED!==true) {
    die();
}
IncludeTemplateLangFile(__FILE__);
?>
<?php if ($mainPage): ?>

<?php else: ?>
</div>
</main>

				<?endif;?>


  <section>
    <div class="section container">
      <div class="order">
        <div class="order__text">
          Закажите пошив текстильных изедилий по индвидиуальному проекту
        </div>
        <div class="order__button">
          <button type="button" class="btn btn-primary btn-lg btn-block" href="#" role="button" data-toggle="modal" data-target="#orderModal">Заказать</button>
        </div>
      </div>
    </div>
  </section>

  <div class="modal fade" id="orderModal" tabindex="-1" role="dialog" aria-labelledby="order Modal">
    <div class="modal-dialog" role="document">
      <div class="modal-content py-4 px-5">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
          <h4 class="modal-title">Заявка</h4>
        </div>
        <div class="modal-body">
          <?$APPLICATION->IncludeComponent(
              	"altasib:feedback.form",
              	"orderModal",
              	array(
              		"ACTIVE_ELEMENT" => "Y",
              		"ADD_HREF_LINK" => "Y",
              		"ALX_LINK_POPUP" => "N",
              		"BBC_MAIL" => "",
              		"CATEGORY_SELECT_NAME" => "Выберите категорию",
              		"CHECKBOX_TYPE" => "CHECKBOX",
              		"CHECK_ERROR" => "Y",
              		"COLOR_SCHEME" => "BRIGHT",
              		"EVENT_TYPE" => "ALX_FEEDBACK_FORM",
              		"FB_TEXT_NAME" => "",
              		"FB_TEXT_SOURCE" => "PREVIEW_TEXT",
              		"FORM_ID" => "1",
              		"IBLOCK_ID" => "15",
              		"IBLOCK_TYPE" => "altasib_feedback",
              		"INPUT_APPEARENCE" => array(
              			0 => "DEFAULT",
              		),
              		"JQUERY_EN" => "jquery",
              		"LINK_SEND_MORE_TEXT" => "Отправить ещё одно сообщение",
              		"LOCAL_REDIRECT_ENABLE" => "N",
              		"MASKED_INPUT_PHONE" => array(
              			0 => "PHONE",
              		),
              		"MESSAGE_OK" => "Ваше сообщение было успешно отправлено",
              		"NAME_ELEMENT" => "ALX_DATE",
              		"PROPERTY_FIELDS" => array(
              			0 => "PHONE",
              			1 => "FIO",
              			2 => "EMAIL",
              			3 => "FILE",
              			4 => "FEEDBACK_TEXT",
              		),
              		"PROPERTY_FIELDS_REQUIRED" => array(
              			0 => "PHONE",
              			1 => "FIO",
              		),
              		"PROPS_AUTOCOMPLETE_EMAIL" => array(
              			0 => "EMAIL",
              		),
              		"PROPS_AUTOCOMPLETE_NAME" => array(
              			0 => "FIO",
              		),
              		"PROPS_AUTOCOMPLETE_PERSONAL_PHONE" => array(
              			0 => "PHONE",
              		),
              		"PROPS_AUTOCOMPLETE_VETO" => "N",
              		"SECTION_FIELDS_ENABLE" => "N",
              		"SECTION_MAIL_ALL" => "nikitin.p.94@gmail.com",
              		"SEND_IMMEDIATE" => "Y",
              		"SEND_MAIL" => "N",
              		"SHOW_LINK_TO_SEND_MORE" => "Y",
              		"SHOW_MESSAGE_LINK" => "Y",
              		"USERMAIL_FROM" => "N",
              		"USER_CONSENT" => "Y",
              		"USER_CONSENT_ID" => "1",
              		"USER_CONSENT_INPUT_LABEL" => "",
              		"USER_CONSENT_IS_CHECKED" => "Y",
              		"USER_CONSENT_IS_LOADED" => "N",
              		"USE_CAPTCHA" => "N",
              		"WIDTH_FORM" => "100%",
              		"COMPONENT_TEMPLATE" => "orderModal",
              		"COLOR_THEME" => "",
              		"COLOR_OTHER" => "#D8A654"
              	),
              	false
              );?>
        </div>
      </div>
      <!-- /.modal-content -->
    </div>
    <!-- /.modal-dialog -->
  </div>
  <!-- /.modal -->

  <footer>
    <div class="footer">
      <div class="container">
        <div class="row mb-4">
          <nav >
            <div class="col-md-6 col-sm-6  col-xs-6">
              <?$APPLICATION->IncludeComponent("bitrix:menu", "footer-nav", Array(
                	"ALLOW_MULTI_SELECT" => "N",	// Разрешить несколько активных пунктов одновременно
                		"CHILD_MENU_TYPE" => "",	// Тип меню для остальных уровней
                		"DELAY" => "N",	// Откладывать выполнение шаблона меню
                		"MAX_LEVEL" => "1",	// Уровень вложенности меню
                		"MENU_CACHE_GET_VARS" => "",	// Значимые переменные запроса
                		"MENU_CACHE_TIME" => "3600",	// Время кеширования (сек.)
                		"MENU_CACHE_TYPE" => "N",	// Тип кеширования
                		"MENU_CACHE_USE_GROUPS" => "Y",	// Учитывать права доступа
                		"ROOT_MENU_TYPE" => "bottom",	// Тип меню для первого уровня
                		"USE_EXT" => "N",	// Подключать файлы с именами вида .тип_меню.menu_ext.php
                		"COMPONENT_TEMPLATE" => ".default"
                	),
                	false
                );?>
                <div class="footer-copyright mt-5">

                  <small> Компания «Loffilab» Все права защищены. © 1998-2015. Нелицензированное использование материалов данного сайта запрещено</small>

                </div>
            </div>

            <div class="col-md-3 col-sm-4 col-xs-6">
              <address>
                <div class="mb-3">
                  Москва, ул. Спиридоновка, д.4, стр.1
                </div>
                <div class="mb-3">
                  8 (499) 404-12-55
                </div>
                <div >
                  <a href="mailto:info@loffilab.ru">info@loffilab.ru</a>
                </div>
              </address>
            </div>
            <div class="col-md-2 col-sm-2 mb-3 col-xs-6  ">
              <ul class="nav nav-pills ">
                <li class="pull-right">
                  <a class="nav-link " href="#"><img src="<?=SITE_TEMPLATE_PATH?>/img/facebook.svg" alt="Facebook logo" width="30px"></a>
                </li>
                <li class="pull-right">
                  <a class="nav-link" href="#"><img src="<?=SITE_TEMPLATE_PATH?>/img/instagram.svg" alt="instagram logo" width="30px"></a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </div>
    </div>
  </footer>

  <script src="http://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js"></script>
  <!-- 33 KB -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.11.0/umd/popper.min.js" integrity="sha384-b/U6ypiBEHpOf/4+1nzFpr53nxSS+GLCkfwBdFNTxtclqqenISfwAzpKaMNFNmj4" crossorigin="anonymous"></script>
  <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js" integrity="sha384-Tc5IQib027qvyjSMfHjOMaLkfuWVxZxUPnCJA7l2mCWNIpG9mGCD8wGNIcPD7Txa" crossorigin="anonymous"></script>
  <script src="<?=SITE_TEMPLATE_PATH?>/js/main.js"></script>
  <script src="http://localhost:35729/livereload.js"></script>



</body>

</html>
